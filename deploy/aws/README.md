# Deploy Turnout on AWS

This repo is a Vite/React app with a PHP API. The AWS path runs both in **one Docker host** plus **MySQL**, so you get a public URL without Vercel.

This Cursor environment **cannot log into your AWS account**. After you configure AWS credentials, one command creates the stack.

## What you get

- Amazon Linux 2023 EC2 (`t3.medium` by default)
- Docker Compose: Turnout app (nginx + PHP 8.3) + MySQL 8
- Security group open on ports 80 and 443
- SSM Session Manager (no SSH key required)

Typical first-month cost in `us-east-1` is roughly a t3.medium + 30 GB disk (on the order of tens of USD). Stop/delete the stack when you do not need it.

## 1) One-command AWS deploy

On a machine with [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) v2:

```bash
aws configure   # Access Key, Secret, region (example: us-east-1)

export DB_PASS='choose-a-strong-password'
export DB_ROOT_PASS='choose-a-strong-root-password'
export SESSION_TOKEN_SECRET="$(openssl rand -hex 24)"
export GIT_BRANCH=cursor/aws-deploy-cf78   # use main after this PR is merged
export AWS_REGION=us-east-1

chmod +x deploy/aws/deploy.sh
./deploy/aws/deploy.sh
```

The script prints **PublicIp**. Wait 5–10 minutes for the first image build, then:

```bash
curl http://YOUR_PUBLIC_IP/api/health
# open http://YOUR_PUBLIC_IP/ in a browser
```

Sign up as an organizer at `http://YOUR_PUBLIC_IP/signup`.

### Optional env

| Variable | Purpose |
|---|---|
| `KEY_NAME` | Existing EC2 key pair for SSH |
| `INSTANCE_TYPE` | Default `t3.medium` |
| `PAYHERE_MERCHANT_ID` / `PAYHERE_MERCHANT_SECRET` | Payments |
| `STACK_NAME` | CloudFormation stack name (default `turnout`) |

Tear down:

```bash
aws cloudformation delete-stack --stack-name turnout --region us-east-1
```

## 2) Run the same stack locally (or on any VM)

```bash
cd deploy/aws
cp env.example .env
# edit DB_PASS, DB_ROOT_PASS, SESSION_TOKEN_SECRET
docker compose up --build
```

App: http://localhost/  
API health: http://localhost/api/health

## Production notes

- **HTTPS / PayHere:** PayHere notify URLs require HTTPS. Point a domain at the Elastic IP, put Caddy or ACM+ALB in front, then set `APP_BASE_URL=https://your-domain` and `SESSION_COOKIE_SECURE=true`.
- **Uploads** persist in the `uploads` Docker volume. For multi-instance later, move files to S3.
- **Custom event domains** in this repo still assume Vercel DNS. AWS needs CloudFront/ALB host routing if you want that feature here.
- Do not commit `deploy/aws/.env`.

## Architecture

```
Browser → :80 nginx
            ├─ /           marketing page
            ├─ /api/*      PHP (cpanel/api via api/index.php)
            └─ SPA routes  React (dist)
         MySQL 8 (same host)
```
