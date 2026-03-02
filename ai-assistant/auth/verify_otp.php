<?php
// ============================================
// VERIFY OTP
// ============================================
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$email = trim($data['email'] ?? '');
$otp = trim($data['otp'] ?? '');

if (empty($email) || empty($otp)) {
    echo json_encode(['success' => false, 'message' => 'Email and OTP are required']);
    exit;
}

try {
    $stmt = $pdo->prepare('SELECT id FROM password_resets WHERE email = ? AND otp = ? AND used = 0 AND expires_at > NOW()');
    $stmt->execute([$email, $otp]);
    $reset = $stmt->fetch();

    if (!$reset) {
        echo json_encode(['success' => false, 'message' => 'Invalid or expired OTP']);
        exit;
    }

    // Mark as used
    $stmt = $pdo->prepare('UPDATE password_resets SET used = 1 WHERE id = ?');
    $stmt->execute([$reset['id']]);

    echo json_encode(['success' => true, 'message' => 'OTP verified!']);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Verification failed']);
}
?>
