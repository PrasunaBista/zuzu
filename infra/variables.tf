variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "centralus"
}

variable "storage_account_name" {
  description = "Globally unique Storage Account name (lowercase, 3–24 chars)"
  type        = string
}

variable "static_web_app_name" {
  description = "Name of the Static Web App"
  type        = string
  default     = "swa-zuzu-mvp"
}

variable "function_app_name" {
  description = "Name of the Function App"
  type        = string
  default     = "func-zuzu-mvp"
}

variable "key_vault_name" {
  description = "Key Vault name (3–24 alphanumeric, globally unique)"
  type        = string
}
