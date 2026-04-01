<?php
declare(strict_types=1);

function sanitize_string($value, int $maxLength = 255): string
{
    $value = is_string($value) ? trim($value) : '';
    $value = strip_tags($value);

    if ($maxLength > 0) {
        $value = mb_substr($value, 0, $maxLength);
    }

    return $value;
}

function sanitize_nullable_string($value, int $maxLength = 255): ?string
{
    $sanitized = sanitize_string($value, $maxLength);
    return $sanitized === '' ? null : $sanitized;
}

function sanitize_text($value, int $maxLength = 5000): string
{
    $value = is_string($value) ? trim($value) : '';
    if ($maxLength > 0) {
        $value = mb_substr($value, 0, $maxLength);
    }

    return $value;
}

function sanitize_email($value): string
{
    $email = strtolower(trim((string) $value));
    return filter_var($email, FILTER_SANITIZE_EMAIL) ?: '';
}

function sanitize_int($value, int $default = 0): int
{
    $result = filter_var($value, FILTER_VALIDATE_INT);
    return $result === false ? $default : (int) $result;
}

function sanitize_bool($value, bool $default = false): bool
{
    if (is_bool($value)) {
        return $value;
    }

    $result = filter_var($value, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
    return $result === null ? $default : (bool) $result;
}
