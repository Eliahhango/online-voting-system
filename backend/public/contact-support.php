<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/logger.php';
require_once __DIR__ . '/../helpers/sanitizer.php';
require_once __DIR__ . '/../helpers/validator.php';

require_method('POST');

$input = get_json_input();

$fullName = sanitize_string($input['full_name'] ?? '', 120);
$email = sanitize_email($input['email'] ?? '');
$topic = sanitize_string($input['topic'] ?? '', 120);
$message = sanitize_text($input['message'] ?? '', 2500);

$errors = [];
if ($fullName === '') {
    $errors['full_name'] = 'Full name is required';
}
if ($email === '') {
    $errors['email'] = 'Email is required';
} else {
    $emailError = validate_email_format($email);
    if ($emailError !== null) {
        $errors['email'] = $emailError;
    }
}
if ($topic === '') {
    $errors['topic'] = 'Support topic is required';
}
if ($message === '') {
    $errors['message'] = 'Message is required';
}

if (!empty($errors)) {
    json_error('Please fix the highlighted fields and try again.', 422, $errors);
}

try {
    $ticketId = 'CT-' . strtoupper(bin2hex(random_bytes(4)));

    audit_log('public.contact_inquiry', null, [
        'ticket_id' => $ticketId,
        'full_name' => $fullName,
        'email' => $email,
        'topic' => $topic,
        'message' => $message,
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
    ]);

    json_success([
        'ticket_id' => $ticketId,
    ], 'Inquiry submitted successfully. Our team will contact you shortly.');
} catch (Throwable $e) {
    app_log('error', 'Contact inquiry failed', ['error' => $e->getMessage()]);
    json_error('Unable to submit inquiry right now', 500);
}
