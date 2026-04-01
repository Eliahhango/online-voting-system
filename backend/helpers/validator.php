<?php
declare(strict_types=1);

function require_fields(array $input, array $fields): array
{
    $errors = [];
    foreach ($fields as $field) {
        if (!array_key_exists($field, $input) || trim((string) $input[$field]) === '') {
            $errors[$field] = ucfirst(str_replace('_', ' ', $field)) . ' is required';
        }
    }

    return $errors;
}

function validate_email_format(string $email): ?string
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) ? null : 'Invalid email format';
}

function validate_password_strength(string $password): ?string
{
    if (strlen($password) < 8) {
        return 'Password must be at least 8 characters';
    }

    if (!preg_match('/[A-Z]/', $password)) {
        return 'Password must include at least one uppercase letter';
    }

    if (!preg_match('/[a-z]/', $password)) {
        return 'Password must include at least one lowercase letter';
    }

    if (!preg_match('/[0-9]/', $password)) {
        return 'Password must include at least one number';
    }

    return null;
}

function validate_enum_value(string $value, array $allowed, string $fieldName): ?string
{
    if (!in_array($value, $allowed, true)) {
        return sprintf('%s must be one of: %s', $fieldName, implode(', ', $allowed));
    }

    return null;
}

function validate_datetime_string(string $value, string $fieldName): ?string
{
    if ($value === '') {
        return $fieldName . ' is required';
    }

    $timestamp = strtotime($value);
    if ($timestamp === false) {
        return $fieldName . ' must be a valid datetime';
    }

    return null;
}
