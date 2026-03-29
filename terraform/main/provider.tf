terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "gcs" {
    # bucket and prefix are supplied via -backend-config in backend.conf
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
