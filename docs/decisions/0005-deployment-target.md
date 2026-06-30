# ADR-0005: AWS ECS Fargate sebagai deployment target default

- **Status**: accepted
- **Tanggal**: 2026-06-11

## Konteks

Boilerplate perlu pilih default deploy target agar Dockerfile, CI/CD, dan runbook fokus. Bisa diganti per-service kalau perlu.

## Opsi yang dipertimbangkan

### Opsi A: Railway
- Pros: Sangat simple, deploy dari git, auto-scale
- Cons: Limit kontrol networking (port custom susah), vendor lock-in kuat

### Opsi B: Render
- Pros: Mirip Railway, native cron
- Cons: Scale lebih basic, networking limited

### Opsi C: AWS ECS Fargate (pilihan)
- Pros: Industry standard, networking penuh (VPC, NLB), IAM granular, banyak managed service tetangga, tim engineer familiar
- Cons: Setup ribet (Terraform/CDK), cost lebih tinggi di skala kecil

### Opsi D: AWS Lambda
- Pros: Pay-per-use
- Cons: Worker long-running tidak cocok (15 menit limit), Bull worker butuh persistent process. **Tidak cocok.**

## Keputusan

**AWS ECS Fargate** default untuk 2 service per repo:
- `<service>-api-task` (Fargate service, behind ALB, port 3000)
- `<service>-worker-task` (Fargate service, scale by queue depth)

Image dari satu Dockerfile multi-stage (`--target api|worker`).

Managed services pendukung:
- RDS Postgres
- ElastiCache Redis
- S3 untuk media (kalau service butuh)
- Secrets Manager untuk env
- CloudWatch Logs

## Konsekuensi

### Positif
- Vendor-neutral Docker image — bisa migrate ke Cloud Run, Railway, Render kapan pun
- Full network control
- IAM per task — no shared credential
- Auto-scale by metric (queue depth, CPU)

### Negatif (yang kami terima)
- Setup Terraform/CDK awal butuh waktu
- Cost minimum lebih tinggi
- Operational learning curve

### Migrasi / rollout
- Lokal: Docker Compose
- Staging: ECS single AZ
- Prod: ECS multi-AZ + auto-scaling

## Trigger untuk revisit

- Saat cost > $X/bulan dan utilization rendah → EC2 Auto Scaling
- Saat butuh K8s feature spesifik → EKS
- Saat customer ada di geo non-AWS (regulator) → multi-cloud
