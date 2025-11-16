terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}

  subscription_id = "f268d91c-ed09-4b22-995c-a1223380f64f"
  tenant_id       = "5c46d65d-ee5c-4513-8cd4-af98d15e6833"

  use_cli = true

  # We turned this off earlier to avoid long hangs
  resource_provider_registrations = "none"
}
