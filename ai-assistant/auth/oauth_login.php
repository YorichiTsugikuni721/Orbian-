<?php
// ============================================
// OAUTH LOGIN HANDLER (for all providers)
// ============================================
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$provider = $data['provider'] ?? '';
$oauthId = $data['oauth_id'] ?? '';
$email = trim($data['email'] ?? '');
$username = trim($data['username'] ?? '');

if (empty($provider) || empty($oauthId)) {
    echo json_encode(['success' => false, 'message' => 'Provider and OAuth ID required']);
    exit;
}

try {
    // Check if user exists by OAuth
    $stmt = $pdo->prepare('SELECT id, username, email FROM users WHERE oauth_provider = ? AND oauth_id = ?');
    $stmt->execute([$provider, $oauthId]);
    $user = $stmt->fetch();

    if ($user) {
        // Existing OAuth user — login
        $pdo->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')->execute([$user['id']]);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['email'] = $user['email'];

        echo json_encode([
            'success' => true,
            'message' => 'Login successful!',
            'user' => $user
        ]);
        exit;
    }

    // Check if email exists (link accounts)
    if (!empty($email)) {
        $stmt = $pdo->prepare('SELECT id, username, email FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if ($user) {
            $pdo->prepare('UPDATE users SET oauth_provider = ?, oauth_id = ?, last_login = NOW() WHERE id = ?')
                ->execute([$provider, $oauthId, $user['id']]);
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['email'] = $user['email'];

            echo json_encode([
                'success' => true,
                'message' => 'Account linked & logged in!',
                'user' => $user
            ]);
            exit;
        }
    }

    // Create new user
    if (empty($email)) $email = $oauthId . '@' . $provider . '.orbian';
    if (empty($username)) $username = explode('@', $email)[0];

    // Ensure unique username
    $baseUsername = $username;
    $counter = 1;
    while (true) {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
        $stmt->execute([$username]);
        if (!$stmt->fetch()) break;
        $username = $baseUsername . $counter;
        $counter++;
    }

    $randomPass = password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT);

    $stmt = $pdo->prepare('INSERT INTO users (username, email, password, oauth_provider, oauth_id) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$username, $email, $randomPass, $provider, $oauthId]);
    $userId = $pdo->lastInsertId();

    $pdo->prepare('INSERT INTO user_settings (user_id) VALUES (?)')->execute([$userId]);

    $_SESSION['user_id'] = $userId;
    $_SESSION['username'] = $username;
    $_SESSION['email'] = $email;

    echo json_encode([
        'success' => true,
        'message' => 'Account created!',
        'user' => ['id' => $userId, 'username' => $username, 'email' => $email]
    ]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'OAuth login failed']);
}
?>
