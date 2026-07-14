<?php

declare(strict_types=1);

require __DIR__ . '/../cpanel/api/lib/env.php';
require __DIR__ . '/../cpanel/api/lib/db.php';
require __DIR__ . '/../cpanel/api/lib/user_migrations.php';
require __DIR__ . '/../cpanel/api/lib/super_admin.php';

load_dotenv_if_present();
putenv('SUPER_ADMIN_BOOTSTRAP=true');
putenv('SUPER_ADMIN_RESET_PASSWORD=true');

$pdo = db();
ensure_users_role_support($pdo);
ensure_default_super_admin($pdo);

$email = super_admin_bootstrap_email();
echo "Super admin ready: {$email}\n";
echo "Password: " . super_admin_bootstrap_password() . "\n";
