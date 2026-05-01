variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "github_org" {
  description = "GitHub organisation or username that owns the repository"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (without the org prefix)"
  type        = string
  default     = "guppy-playground"
}

variable "backend_image" {
  description = "Full image reference used for the initial backend Cloud Run deploy"
  type        = string
}

variable "frontend_image" {
  description = "Full image reference used for the initial frontend Cloud Run deploy"
  type        = string
}

variable "allowed_origins" {
  description = "JSON-encoded list of allowed CORS origins passed to the backend"
  type        = string
  default     = "[\"https://guppyfisher.dev\"]"
}

variable "compile_timeout_seconds" {
  description = "Guppy compilation timeout in seconds"
  type        = string
  default     = "60"
}

variable "simulate_timeout_seconds" {
  description = "Quantum simulation timeout in seconds"
  type        = string
  default     = "15"
}

variable "max_shots" {
  description = "Maximum number of simulation shots"
  type        = string
  default     = "8192"
}

variable "sandbox_memory_mb" {
  description = "Subprocess sandbox memory limit in MB"
  type        = string
  default     = "512"
}

variable "max_code_length" {
  description = "Maximum source code length in characters"
  type        = string
  default     = "4000"
}
