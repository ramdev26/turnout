#!/usr/bin/env bash
# Launch Turnout on AWS EC2 (Docker + MySQL).
# Requires: aws CLI, an IAM user/role that can create EC2/IAM/CloudFormation resources.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STACK_NAME="${STACK_NAME:-turnout}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
BRANCH="${GIT_BRANCH:-main}"
REPO="${GIT_REPO:-https://github.com/ramdev26/turnout.git}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.medium}"

if ! command -v aws >/dev/null 2>&1; then
  echo "Install the AWS CLI first: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  exit 1
fi

if ! aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
  echo "AWS credentials are not configured."
  echo "Run: aws configure"
  echo "Or export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION"
  exit 1
fi

if [[ -z "${DB_PASS:-}" || -z "${DB_ROOT_PASS:-}" || -z "${SESSION_TOKEN_SECRET:-}" ]]; then
  echo "Set these env vars before deploying:"
  echo "  export DB_PASS='...'"
  echo "  export DB_ROOT_PASS='...'"
  echo "  export SESSION_TOKEN_SECRET='$(openssl rand -hex 24 2>/dev/null || echo long-random-secret)'"
  echo "Optional: AWS_REGION, GIT_BRANCH, KEY_NAME, PAYHERE_MERCHANT_ID, PAYHERE_MERCHANT_SECRET"
  exit 1
fi

PARAMS=(
  "ParameterKey=InstanceType,ParameterValue=${INSTANCE_TYPE}"
  "ParameterKey=GitRepo,ParameterValue=${REPO}"
  "ParameterKey=GitBranch,ParameterValue=${BRANCH}"
  "ParameterKey=DbPassword,ParameterValue=${DB_PASS}"
  "ParameterKey=DbRootPassword,ParameterValue=${DB_ROOT_PASS}"
  "ParameterKey=SessionTokenSecret,ParameterValue=${SESSION_TOKEN_SECRET}"
  "ParameterKey=PayHereSandbox,ParameterValue=${PAYHERE_SANDBOX:-true}"
  "ParameterKey=PayHereMerchantId,ParameterValue=${PAYHERE_MERCHANT_ID:-}"
  "ParameterKey=PayHereMerchantSecret,ParameterValue=${PAYHERE_MERCHANT_SECRET:-}"
)

if [[ -n "${KEY_NAME:-}" ]]; then
  PARAMS+=("ParameterKey=KeyName,ParameterValue=${KEY_NAME}")
fi

echo "Deploying stack ${STACK_NAME} in ${REGION} (branch ${BRANCH})…"
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$ROOT/deploy/aws/cloudformation.yaml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides "${PARAMS[@]}"

echo
echo "Waiting for instance public IP…"
aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output table

echo
echo "First boot builds the Docker image (5–10 minutes). Then open http://<PublicIp>/"
echo "Health check: curl http://<PublicIp>/api/health"
