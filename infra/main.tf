// Get info about the currently logged-in Azure identity
data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "zuzu" {
  name     = "rg-zuzu-mvp"
  location = var.location
}

# ---------- Storage Account for Function App ----------

resource "azurerm_storage_account" "func" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.zuzu.name
  location                 = azurerm_resource_group.zuzu.location
  account_tier             = "Standard"
  account_replication_type = "LRS"


}

# ---------- App Service Plan (Consumption) for Functions ----------

resource "azurerm_service_plan" "func_plan" {
  name                = "asp-zuzu-func"
  resource_group_name = azurerm_resource_group.zuzu.name
  location            = azurerm_resource_group.zuzu.location

  os_type  = "Linux"
  sku_name = "Y1"    # Y1 = Consumption plan for Functions
}

# ---------- Linux Function App (Backend API shell) ----------

resource "azurerm_linux_function_app" "backend" {
  name                = var.function_app_name
  resource_group_name = azurerm_resource_group.zuzu.name
  location            = azurerm_resource_group.zuzu.location

  service_plan_id            = azurerm_service_plan.func_plan.id
  storage_account_name       = azurerm_storage_account.func.name
  storage_account_access_key = azurerm_storage_account.func.primary_access_key

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      # Assuming your backend will be Python-based
      python_version = "3.11"
    }
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME" = "python"
    "WEBSITE_RUN_FROM_PACKAGE" = "1"
    # Later we’ll plug Key Vault / DB connection info here
  }
}

# ---------- Key Vault for secrets ----------

resource "azurerm_key_vault" "zuzu" {
  name                = var.key_vault_name
  location            = azurerm_resource_group.zuzu.location
  resource_group_name = azurerm_resource_group.zuzu.name

  tenant_id = data.azurerm_client_config.current.tenant_id
  sku_name  = "standard"

  soft_delete_retention_days = 7
  purge_protection_enabled   = false

  # Give the Function App's managed identity permission to read secrets
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = azurerm_linux_function_app.backend.identity[0].principal_id

    secret_permissions = [
      "Get",
      "List",
    ]
  }
}

# ---------- Static Web App for your React frontend ----------

resource "azurerm_static_web_app" "frontend" {
  name                = var.static_web_app_name
  resource_group_name = azurerm_resource_group.zuzu.name
  location            = azurerm_resource_group.zuzu.location

  # Free tier is fine for MVP, defaults are Free
}
