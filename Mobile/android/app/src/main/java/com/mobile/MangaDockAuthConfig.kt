package com.mobile

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.uimanager.ViewManager

class MangaDockAuthConfigModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "MangaDockAuthConfig"
  override fun getConstants(): MutableMap<String, Any> = mutableMapOf(
    "url" to BuildConfig.MANGADOCK_SUPABASE_URL,
    "publicKey" to BuildConfig.MANGADOCK_SUPABASE_PUBLIC_KEY,
  )
}

class MangaDockAuthConfigPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(MangaDockAuthConfigModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
