<?php
// ============================================
// RESET PASSWORD (After OTP verification)
// ============================================
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$email = trim($data['email'] ?? '');
$newPassword = $data['new_password'] ?? '';

if (empty($email) || empty($newPassword)) {
    echo json_encode(['success' => false, 'message' => 'Email and new password required']);
    exit;
}

if (strlen($newPassword) < 6) {
    echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters']);
    exit;
}

try {
    $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);

    $stmt = $pdo->prepare('UPDATE users SET password = ? WHERE email = ?');
    $stmt->execute([$hashedPassword, $email]);

    // Cleanup
    $stmt = $pdo->prepare('DELETE FROM password_resets WHERE email = ?');
    $stmt->execute([$email]);

    echo json_encode(['success' => true, 'message' => 'Password reset successfully!']);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Password reset failed']);
}
?>
