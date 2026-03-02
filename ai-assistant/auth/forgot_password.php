<?php
// ============================================
// FORGOT PASSWORD — Send OTP
// ============================================
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$email = trim($data['email'] ?? '');

if (empty($email)) {
    echo json_encode(['success' => false, 'message' => 'Email is required']);
    exit;
}

try {
    // Check if user exists
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if (!$stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'No account found with this email']);
        exit;
    }

    // Generate 6-digit OTP
    $otp = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = date('Y-m-d H:i:s', strtotime('+10 minutes'));

    // Remove old OTPs
    $stmt = $pdo->prepare('DELETE FROM password_resets WHERE email = ?');
    $stmt->execute([$email]);

    // Store new OTP
    $stmt = $pdo->prepare('INSERT INTO password_resets (email, otp, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$email, $otp, $expiresAt]);

    // Send email (using mail() function — needs proper SMTP setup on server)
    $subject = "ORBIAN AI — Password Reset Code: $otp";
    $htmlBody = "
    <div style='font-family:Arial;max-width:480px;margin:auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid rgba(124,58,237,0.3);'>
        <div style='background:linear-gradient(135deg,#7c3aed,#6366f1);padding:30px;text-align:center;'>
            <h1 style='color:#fff;margin:0;font-size:22px;'>🔐 Password Reset</h1>
        </div>
        <div style='padding:30px;color:#e2e8f0;text-align:center;'>
            <p style='margin:0 0 20px;font-size:15px;color:#94a3b8;'>Your one-time password reset code is:</p>
            <div style='background:rgba(124,58,237,0.15);border:2px solid rgba(124,58,237,0.4);border-radius:12px;padding:20px;margin:0 auto 20px;max-width:200px;'>
                <span style='font-size:32px;font-weight:900;letter-spacing:8px;color:#a78bfa;'>$otp</span>
            </div>
            <p style='font-size:13px;color:#64748b;'>Expires in <strong style='color:#f87171;'>10 minutes</strong>.</p>
        </div>
    </div>";

    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8\r\n";
    $headers .= "From: ORBIAN AI <noreply@orbian-ai.local>\r\n";

    // Try to send email (will work if PHP mail is configured)
    @mail($email, $subject, $htmlBody, $headers);

    // Always return success (in dev mode, OTP is stored in DB, user can check console)
    echo json_encode([
        'success' => true,
        'message' => 'OTP sent to your email!',
        'dev_otp' => $otp // REMOVE THIS IN PRODUCTION
    ]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Failed to generate OTP']);
}
?>
