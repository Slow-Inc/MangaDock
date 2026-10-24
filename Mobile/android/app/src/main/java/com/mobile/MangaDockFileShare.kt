package com.mobile

import android.content.ClipData
import android.content.Intent
import android.util.Base64
import androidx.core.content.FileProvider
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import java.io.File

/** Writes a validated web export into the app cache and opens the Android share sheet. */
class MangaDockFileShareModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "MangaDockFileShare"

  @ReactMethod
  fun shareFile(filename: String, mimeType: String, base64: String, promise: Promise) {
    val activity = context.currentActivity
    if (activity == null) {
      promise.reject("no_activity", "No foreground activity")
      return
    }
    if (mimeType !in SHAREABLE_TYPES || filename.isBlank() || filename.contains('/') || filename.contains('\\')) {
      promise.reject("invalid_file", "Unsupported export")
      return
    }
    try {
      val bytes = Base64.decode(base64, Base64.DEFAULT)
      if (bytes.isEmpty() || bytes.size > MAX_BYTES) {
        promise.reject("invalid_file", "Unsupported export size")
        return
      }
      val directory = File(context.cacheDir, "shared")
      // Exports are transient: keep only the one being shared.
      directory.deleteRecursively()
      directory.mkdirs()
      val file = File(directory, filename)
      file.writeBytes(bytes)
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
      val send = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_TITLE, filename)
        clipData = ClipData.newRawUri(filename, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      activity.startActivity(Intent.createChooser(send, filename).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("share_failed", "Share failed", error)
    }
  }

  companion object {
    private val SHAREABLE_TYPES = setOf("text/csv", "text/plain", "application/json")
    private const val MAX_BYTES = 10 * 1024 * 1024
  }
}

class MangaDockFileSharePackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(MangaDockFileShareModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
