package com.mobile

import android.app.Activity
import android.content.Intent
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialManagerCallback
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.gms.common.GoogleApiAvailabilityLight
import com.facebook.CallbackManager
import com.facebook.FacebookCallback
import com.facebook.FacebookException
import com.facebook.FacebookSdk
import com.facebook.login.LoginConfiguration
import com.facebook.login.LoginManager
import com.facebook.login.LoginResult
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** Provider tokens stay native; only a verified Supabase session crosses to JS. */
class NativeSdkAuthModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private class Operation(val id: String, val provider: String, val promise: Promise, val nonce: String) {
    val cancellation = CancellationSignal()
    var call: Call? = null
    var timeout: Runnable? = null
  }
  private val main = Handler(Looper.getMainLooper())
  private val worker = Executors.newSingleThreadExecutor()
  private val http = OkHttpClient.Builder().callTimeout(20, TimeUnit.SECONDS)
    .connectTimeout(10, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS).build()
  private var active: Operation? = null
  private var facebookCallback: CallbackManager? = null
  private var facebookOperation: Operation? = null
  private val activityListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      facebookCallback?.onActivityResult(requestCode, resultCode, data)
    }
  }
  init { context.addActivityEventListener(activityListener) }
  override fun getName() = "MangaDockNativeSdkAuth"

  private fun randomNonce(): String = ByteArray(32).also {SecureRandom().nextBytes(it)}.let {
    Base64.encodeToString(it, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
  }
  private fun digest(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray())
    .joinToString("") {"%02x".format(it)}

  @ReactMethod
  fun signIn(provider: String, requestId: String, promise: Promise) {
    main.post {
      if (provider !in listOf("google", "facebook") || requestId.isBlank() || requestId.length > 128) {
        promise.reject("auth/sdk-request", "Invalid native login request")
        return@post
      }
      // Facebook uses one SDK callback channel. Do not let a new operation consume
      // an older LoginActivity result before that activity has finished.
      if (facebookOperation != null) {
        promise.reject("auth/sdk-busy", "Facebook login is still finishing")
        return@post
      }
      active?.let {fail(it, "auth/sdk-cancelled")}
      val activity = context.currentActivity
      if (activity == null || activity.isFinishing) {
        promise.reject("auth/sdk-activity", "Login activity is unavailable")
        return@post
      }
      if (BuildConfig.MANGADOCK_SUPABASE_URL.isBlank() || BuildConfig.MANGADOCK_SUPABASE_PUBLIC_KEY.isBlank() ||
        (provider == "google" && BuildConfig.MANGADOCK_GOOGLE_WEB_CLIENT_ID.isBlank()) ||
        (provider == "facebook" && (BuildConfig.MANGADOCK_FACEBOOK_APP_ID.isBlank() || BuildConfig.MANGADOCK_FACEBOOK_CLIENT_TOKEN.isBlank()))) {
        promise.reject("auth/sdk-config", "Native provider configuration is missing")
        return@post
      }
      val operation = Operation(requestId, provider, promise, randomNonce())
      active = operation
      operation.timeout = Runnable {fail(operation, "auth/sdk-timeout")}.also {main.postDelayed(it, 120000)}
      try {
        if (provider == "google") google(activity, operation) else facebook(activity, operation)
      } catch (_: Exception) {
        facebookOperation = null
        fail(operation, "auth/sdk-provider")
      }
    }
  }

  private fun google(activity: Activity, operation: Operation) {
    Log.i("MangaDockSdkAuth", "google play services availability: " + GoogleApiAvailabilityLight.getInstance().isGooglePlayServicesAvailable(context))
    val option = GetSignInWithGoogleOption.Builder(BuildConfig.MANGADOCK_GOOGLE_WEB_CLIENT_ID)
      .setNonce(digest(operation.nonce)).build()
    val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
    CredentialManager.create(context).getCredentialAsync(
      activity, request, operation.cancellation, worker,
      object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
        override fun onResult(result: GetCredentialResponse) {
          main.post {
            if (active !== operation) return@post
            try {
              val credential = result.credential
              if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                fail(operation, "auth/sdk-credential")
                return@post
              }
              val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
              Log.i("MangaDockSdkAuth", "google credential acquired")
              exchange(operation, token, operation.nonce)
            } catch (_: Exception) {fail(operation, "auth/sdk-credential")}
          }
        }
        override fun onError(error: GetCredentialException) {
          main.post {
            Log.i("MangaDockSdkAuth", "google SDK error type: " + error.type)
            fail(operation, when (error) {
              is GetCredentialCancellationException -> "auth/sdk-cancelled"
              is NoCredentialException -> "auth/sdk-no-credential"
              else -> "auth/sdk-provider"
            })
          }
        }
      },
    )
  }

  @Suppress("DEPRECATION")
  private fun facebook(activity: Activity, operation: Operation) {
    if (!FacebookSdk.isInitialized()) {
      FacebookSdk.setAutoLogAppEventsEnabled(false)
      FacebookSdk.setAdvertiserIDCollectionEnabled(false)
      FacebookSdk.sdkInitialize(context)
    }
    if (facebookCallback == null) {
      val callbacks = CallbackManager.Factory.create()
      facebookCallback = callbacks
      LoginManager.getInstance().registerCallback(callbacks, object : FacebookCallback<LoginResult> {
        override fun onSuccess(result: LoginResult) {
          val pending = facebookOperation ?: return
          facebookOperation = null
          if (active !== pending) return
          val token = result.authenticationToken
          // Graph access tokens are not valid Supabase OIDC ID tokens.
          if (token == null || token.claims.nonce != pending.nonce) {
            fail(pending, "auth/sdk-facebook-token")
            return
          }
          exchange(pending, token.token, null)
        }
        override fun onCancel() {
          val pending = facebookOperation ?: return
          facebookOperation = null
          fail(pending, "auth/sdk-cancelled")
        }
        override fun onError(error: FacebookException) {
          val pending = facebookOperation ?: return
          facebookOperation = null
          fail(pending, "auth/sdk-provider")
        }
      })
    }
    facebookOperation = operation
    LoginManager.getInstance().logIn(activity, LoginConfiguration(listOf("public_profile", "email"), operation.nonce))
  }

  private fun exchange(operation: Operation, token: String, nonce: String?) {
    if (active !== operation) return
    val body = JSONObject().put("provider", operation.provider).put("id_token", token)
    if (nonce != null) body.put("nonce", nonce)
    val endpoint = BuildConfig.MANGADOCK_SUPABASE_URL.trimEnd('/') + "/auth/v1/token?grant_type=id_token"
    if (!endpoint.startsWith("https://")) {fail(operation, "auth/sdk-config"); return}
    val call = http.newCall(Request.Builder().url(endpoint)
      .header("apikey", BuildConfig.MANGADOCK_SUPABASE_PUBLIC_KEY)
      .header("Authorization", "Bearer " + BuildConfig.MANGADOCK_SUPABASE_PUBLIC_KEY)
      .post(body.toString().toRequestBody("application/json".toMediaType())).build())
    operation.call = call
    call.enqueue(object : Callback {
      override fun onFailure(call: Call, error: IOException) {
        main.post {fail(operation, "auth/sdk-exchange")}
      }
      override fun onResponse(call: Call, response: Response) {
        try {
          val session = response.use {
            if (!it.isSuccessful) throw IOException("Session exchange failed")
            JSONObject(it.body?.string() ?: "")
          }
          val access = session.optString("access_token")
          val refresh = session.optString("refresh_token")
          if (access.isBlank() || refresh.isBlank()) throw IOException("Invalid session")
          main.post {
            if (active !== operation) return@post
            clear(operation)
            operation.promise.resolve(Arguments.createMap().apply {
              putString("access_token", access)
              putString("refresh_token", refresh)
            })
          }
        } catch (_: Exception) {main.post {fail(operation, "auth/sdk-exchange")}}
      }
    })
  }

  private fun clear(operation: Operation) {
    if (active !== operation) return
    active = null
    operation.timeout?.let {main.removeCallbacks(it)}
    operation.cancellation.cancel()
    operation.call?.cancel()
  }
  private fun fail(operation: Operation, code: String) {
    if (active !== operation) return
    Log.i("MangaDockSdkAuth", operation.provider + " failed: " + code)
    clear(operation)
    operation.promise.reject(code, "Native sign-in did not complete")
  }
  @ReactMethod
  fun cancel(requestId: String) {
    main.post {active?.takeIf {it.id == requestId}?.let {fail(it, "auth/sdk-cancelled")}}
  }
  @ReactMethod
  fun signOut(promise: Promise) {
    main.post {
      active?.let {fail(it, "auth/sdk-cancelled")}
      if (FacebookSdk.isInitialized()) LoginManager.getInstance().logOut()
      CredentialManager.create(context).clearCredentialStateAsync(
        ClearCredentialStateRequest(), null, worker,
        object : CredentialManagerCallback<Void?, ClearCredentialException> {
          override fun onResult(result: Void?) {promise.resolve(null)}
          override fun onError(error: ClearCredentialException) {
            promise.reject("auth/sdk-sign-out", "Cannot clear provider credential state")
          }
        },
      )
    }
  }
  override fun invalidate() {
    context.removeActivityEventListener(activityListener)
    main.post {
      active?.let {fail(it, "auth/sdk-cancelled")}
      facebookCallback?.let {LoginManager.getInstance().unregisterCallback(it)}
      facebookCallback = null
      facebookOperation = null
      worker.shutdownNow()
    }
    super.invalidate()
  }
}

class NativeSdkAuthPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(NativeSdkAuthModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
