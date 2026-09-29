<?php
// 認証処理およびファイル配信を行うスクリプト
declare(strict_types=1);

const USERS_FILE = __DIR__ . '/../private/users.php';
const SESSION_NAME = 'portfolio_auth';

// セッションの初期化および設定
session_name(SESSION_NAME);
session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();

if (isset($_GET['logout'])) {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], (bool) $params['secure'], (bool) $params['httponly']);
    }
    session_destroy();
    header('Location: auth.php');
    exit;
}

$requestedPath = normalizePath((string) ($_GET['path'] ?? '/'));

// リクエストごとに使い捨てのCSP nonceを発行する（GTMが動的に挿入するスクリプトにも strict-dynamic で伝播させる）。
$cspNonce = base64_encode(random_bytes(16));
header('Content-Security-Policy: ' . buildCsp($cspNonce));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = (string) ($_POST['password'] ?? '');
    $users = loadUsers();
    $authenticatedUsername = null;

    foreach ($users as $username => $hash) {
        if (is_string($hash) && password_verify($password, $hash)) {
            $authenticatedUsername = (string) $username;
            break;
        }
    }

    if ($authenticatedUsername !== null) {
        session_regenerate_id(true);
        $_SESSION['authenticated'] = true;
        $_SESSION['username'] = $authenticatedUsername;

        $redirectPath = normalizePath((string) ($_POST['redirect'] ?? '/'));
        header('Location: ' . ($redirectPath === '/' ? './' : '.' . $redirectPath));
        exit;
    }

    $loginError = 'パスワードが正しくありません。';
}

// 認証されていない場合はログインフォームを表示する
if (empty($_SESSION['authenticated'])) {
    renderLogin($requestedPath, $loginError ?? null, $cspNonce);
    exit;
}

serveFile($requestedPath, $cspNonce);

// nonce + strict-dynamic方式のCSPを組み立てる。
// https://developers.google.com/tag-platform/security/guides/csp
function buildCsp(string $nonce): string
{
    $scriptSrc = "'self' 'nonce-{$nonce}' 'strict-dynamic' https://challenges.cloudflare.com https://www.googletagmanager.com https://tagmanager.google.com https://*.clarity.ms";

    return "default-src 'self'; "
        . "script-src {$scriptSrc}; "
        . "style-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://tagmanager.google.com https://fonts.googleapis.com; "
        . "img-src 'self' data: https://challenges.cloudflare.com https://www.googletagmanager.com https://*.google-analytics.com https://ssl.gstatic.com https://www.gstatic.com https://*.clarity.ms https://c.bing.com https://images.unsplash.com https://picsum.photos; "
        . "font-src 'self' data: https://fonts.gstatic.com; "
        . "connect-src 'self' https://challenges.cloudflare.com https://formspree.io https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com https://*.clarity.ms https://c.bing.com https://api.unsplash.com; "
        . "frame-src https://challenges.cloudflare.com https://www.googletagmanager.com; "
        . "form-action 'self' https://formspree.io; "
        . "base-uri 'self'; "
        . "object-src 'none'; "
        . "frame-ancestors 'self'";
}

// ユーザー情報をロードする
function loadUsers(): array
{
    if (!is_file(USERS_FILE)) {
        return [];
    }

    $users = require USERS_FILE;
    return is_array($users) ? $users : [];
}

// 正規化されたパスを返す
function normalizePath(string $path): string
{
    $path = parse_url($path, PHP_URL_PATH) ?: '/';
    $path = '/' . ltrim(rawurldecode($path), '/');

    if (str_contains($path, "\0") || str_contains($path, '..')) {
        return '/index.html';
    }

    // Astroはページをディレクトリ形式（例: /contact/thanks/index.html）で出力するため、
    // ディレクトリを指すパス（末尾がスラッシュ）はindex.htmlに解決する。
    return str_ends_with($path, '/') ? $path . 'index.html' : $path;
}

// 指定されたパスのファイルを配信する
function serveFile(string $path, string $cspNonce): never
{
    $basePath = realpath(__DIR__);
    $filePath = realpath(__DIR__ . $path);

    // .htaccessの拒否ルールは?path=経由やreadfile()には適用されない。
    // 要求パスと実体パスの両方で隠しファイル・ディレクトリを拒否する。
    if (
        $basePath === false || $filePath === false || !str_starts_with($filePath, $basePath . DIRECTORY_SEPARATOR) || !is_file($filePath)
        || preg_match('~(^|/)\.~', $path)
        || preg_match('~(^|/)\.~', substr($filePath, strlen($basePath)))
    ) {
        serveNotFound($cspNonce);
    }

    $mimeTypes = [
        'css' => 'text/css; charset=UTF-8',
        'js' => 'text/javascript; charset=UTF-8',
        'html' => 'text/html; charset=UTF-8',
        'json' => 'application/json; charset=UTF-8',
        'svg' => 'image/svg+xml',
        'webp' => 'image/webp',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'xml' => 'application/xml; charset=UTF-8',
        'txt' => 'text/plain; charset=UTF-8',
    ];
    $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

    // PHPソース、設定、バックアップなど、公開用ではない形式は配信しない。
    if (!isset($mimeTypes[$extension])) {
        serveNotFound($cspNonce);
    }

    header('Content-Type: ' . $mimeTypes[$extension]);

    if ($extension === 'html') {
        // すべてのscript要素にnonceを付与し、strict-dynamicで信頼を伝播させる。
        $html = (string) file_get_contents($filePath);
        $html = preg_replace('/<script\b/i', '<script nonce="' . htmlspecialchars($cspNonce, ENT_QUOTES, 'UTF-8') . '"', $html);
        echo $html;
        exit;
    }

    header('Content-Length: ' . (string) filesize($filePath));
    readfile($filePath);
    exit;
}

function serveNotFound(string $cspNonce): never
{
    $notFoundPath = __DIR__ . '/404.html';
    $html = is_file($notFoundPath) ? (string) file_get_contents($notFoundPath) : '';

    http_response_code(404);
    header('Content-Type: text/html; charset=UTF-8');

    if ($html !== '') {
        $html = preg_replace('/<script\b/i', '<script nonce="' . htmlspecialchars($cspNonce, ENT_QUOTES, 'UTF-8') . '"', $html);
        echo $html;
        exit;
    }

    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Not Found';
    exit;
}

// ログインフォームをレンダリングする
function renderLogin(string $redirectPath, ?string $error, string $cspNonce): never
{
    $hasUsers = is_file(USERS_FILE) && loadUsers() !== [];
    $safeRedirect = htmlspecialchars($redirectPath, ENT_QUOTES, 'UTF-8');
    $authEndpoint = htmlspecialchars((string) ($_SERVER['SCRIPT_NAME'] ?? 'auth.php'), ENT_QUOTES, 'UTF-8');
    $errorHtml = $error === null ? '' : '<p class="error" role="alert">' . htmlspecialchars($error, ENT_QUOTES, 'UTF-8') . '</p>';
    $setupHtml = $hasUsers ? '' : '<p class="setup" role="alert">管理者アカウントが設定されていません。private/users.phpを作成してください。</p>';

    http_response_code($error === null ? 200 : 401);
    header('Content-Type: text/html; charset=UTF-8');
    echo <<<HTML
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta name="robots" content="noindex, nofollow">
  <title>ログイン - Portfolio</title>
  <style>
    :root {
    --color-white: #fff;
    --color-black: #111827;
    --color-red: #ef4444;
    --color-blue-900: #0017c1;
    --color-gray-200: #e5e7eb;
    --color-gray-300: #d1d5db;
    --color-gray-400: #9ca3af;
    --color-gray-700: #374151;
    --color-surface: #f8fafc;
    --color-text: var(--color-black);
    --color-background: var(--color-white);
    --font-not-sans-jp: "Noto Sans JP", "Noto Sans JP Variable", sans-serif;
    --font-size-xxs: 0.625rem;
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.875rem;
    --font-size-md: 1rem;
    --font-size-xl: 1.25rem;
    --radius-md: .5rem;
    --radius-infinite: calc(1px / 0);
    --transition-duration-normal: 240ms;
    }
    body {
    display: grid;
    min-height: 100vh;
    margin: 0;
    place-items: center;
    font-family: var(--font-not-sans-jp);
    }
    main {
    box-sizing: border-box;
    width: min(100% - 4rem, 24rem);
    min-width: 256px;
    padding: 2rem;
    color: var(--color-text);
    }
    h1 {
    margin-top: 0;
    margin-bottom: 1.5rem;
    display: flex;
    place-self: center;
    font-size: var(--font-size-md);
    font-weight: normal;
    }
    h1 svg {
    margin-right: 0.5rem;
    color: var(--color-text);
    }
    form {
    display: grid;
    gap: 0.75rem;
    }
    label {
    color: var(--color-gray-700);
    font-size: var(--font-size-sm);
    }
    input {
    width: 100%;
    padding: 0.7rem 0.75rem;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    box-sizing: border-box;
    font: inherit;
    }
    .password-field {
    position: relative;
    }
    .password-field input {
    padding: 0.7rem 2.75rem 0.7rem 1rem;
    }
    .password-field label {
    position: absolute;
    top: 50%;
    left: 1rem;
    color: var(--color-gray-400);
    transform: translateY(-50%);
    pointer-events: none;
    transition:
        top var(--transition-duration-normal) ease,
        transform var(--transition-duration-normal) ease,
        font-size var(--transition-duration-normal) ease;
    }
    .password-field input::placeholder {
    color: transparent;
    }
    .password-field:focus-within label,
    .password-field input:not(:placeholder-shown) + label {
    top: -0.5rem;
    padding-inline: .25rem;
    color: var(--color-gray-400);
    font-size: var(--font-size-xxs);
    transform: none;
    background-color: white;
    }
    .password-toggle {
    position: absolute;
    top: 50%;
    right: 0.35rem;
    display: grid;
    min-width: 0;
    margin: 0;
    padding: 0.4rem;
    transform: translateY(-50%);
    place-items: center;
    color: var(--color-gray-700);
    border: 0;
    border-radius: var(--radius-infinite);
    background: transparent;
    cursor: pointer;
    }
    .password-toggle:hover {
    color: var(--color-black);
    background: var(--color-gray-200);
    }
    .password-toggle:focus-visible {
    outline: 2px solid var(--color-blue-900);
    outline-offset: 1px;
    }
    .password-toggle[aria-pressed="true"] .password-icon--show,
    .password-toggle[aria-pressed="false"] .password-icon--hide {
    display: none;
    }
    .login-button {
    margin-top: 1rem;
    margin-inline: auto;
    padding: 0.5rem 1.5rem;
    justify-self: start;
    min-width: 8rem;
    color: var(--color-white);
    font-size: var(--font-size-sm);
    outline: 1px solid var(--color-gray-200);
    border-radius: var(--radius-infinite);
    border: 0;
    background-color: var(--color-blue-900);
    cursor: pointer;
    transition:
        color var(--transition-duration-normal) ease,
        font-weight var(--transition-duration-normal) ease,
        background-color var(--transition-duration-normal) ease,
        outline var(--transition-duration-normal) ease,
        text-decoration-color var(--transition-duration-normal) ease,
        text-underline-offset var(--transition-duration-normal) ease,
        opacity var(--transition-duration-normal) ease;
    }
    .login-button:hover,
    .login-button:focus-visible,
    .login-button:active {
    color: var(--color-blue-900);
    font-weight: bold;
    outline: 1px solid var(--color-blue-900);
    background-color: contrast-color(var(--color-blue-900));
    }
    .error,
    .setup {
    color: var(--color-red);
    font-size: var(--font-size-sm);
    }
  </style>
</head>
<body>
  <main>
    <h1><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock preview-icon"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> ログイン</h1>
    {$setupHtml}
    {$errorHtml}
    <form method="post" action="{$authEndpoint}">
      <input type="hidden" name="redirect" value="{$safeRedirect}">
            <div class="password-field">
                <input id="password" name="password" type="password" placeholder="パスワード" autocomplete="current-password" required>
                <label for="password">パスワード</label>
                <button class="password-toggle" type="button" aria-label="パスワードを表示" aria-pressed="false">
                    <svg class="password-icon--show" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.1 12a1 1 0 0 1 0-.2 10.6 10.6 0 0 1 19.8 0 1 1 0 0 1 0 .2 10.6 10.6 0 0 1-19.8 0Z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg class="password-icon--hide" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-.722-3.25"/><path d="M2 8a10.645 10.645 0 0 0 20 0"/><path d="m20 15-1.726-2.05"/><path d="m4 15 1.726-2.05"/><path d="m9 18 .722-3.25"/></svg>
                </button>
            </div>
      <button class="login-button" type="submit">ログイン </button>
    </form>
  </main>
    <script nonce="{$cspNonce}">
        const passwordInput = document.getElementById('password');
        const passwordToggle = document.querySelector('.password-toggle');
        passwordToggle.addEventListener('click', () => {
            const isVisible = passwordInput.type === 'text';
            passwordInput.type = isVisible ? 'password' : 'text';
            passwordToggle.setAttribute('aria-pressed', String(!isVisible));
            passwordToggle.setAttribute('aria-label', isVisible ? 'パスワードを表示' : 'パスワードを隠す');
        });
    </script>
</body>
</html>
HTML;
    exit;
}
