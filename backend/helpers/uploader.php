<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';

function upload_image(string $fieldName, string $destinationDir, array $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp']): ?string
{
    if (!isset($_FILES[$fieldName]) || !is_array($_FILES[$fieldName])) {
        return null;
    }

    $file = $_FILES[$fieldName];

    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('File upload failed with error code ' . (int) $file['error']);
    }

    $originalName = (string) ($file['name'] ?? '');
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

    if (!in_array($extension, $allowedExtensions, true)) {
        throw new RuntimeException('Unsupported file extension');
    }

    if (!is_dir($destinationDir)) {
        mkdir($destinationDir, 0777, true);
    }

    $filename = bin2hex(random_bytes(12)) . '.' . $extension;
    $targetPath = rtrim($destinationDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $filename;

    if (!move_uploaded_file((string) $file['tmp_name'], $targetPath)) {
        throw new RuntimeException('Unable to store uploaded file');
    }

    return $filename;
}
