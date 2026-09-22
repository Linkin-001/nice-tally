@file:Suppress("UNCHECKED_CAST", "USELESS_CAST", "INAPPLICABLE_JVM_NAME", "UNUSED_ANONYMOUS_PARAMETER", "SENSELESS_COMPARISON", "NAME_SHADOWING", "UNNECESSARY_NOT_NULL_ASSERTION")
package uts.sdk.modules.xjSecurity
import android.view.WindowManager
import io.dcloud.uniapp.*
import io.dcloud.uniapp.extapi.*
import io.dcloud.uniappxv.runtime.*
import io.dcloud.unicloud.*
import io.dcloud.uts.*
import io.dcloud.uts.Map
import io.dcloud.uts.Set
import java.security.SecureRandom
import kotlin.properties.Delegates
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import io.dcloud.uts.UTSAndroid
fun randomHex(length: Number): String {
    val rng = SecureRandom()
    var result = ""
    run {
        var i: Number = 0
        while(i < length){
            val n = rng.nextInt(256)
            val h = n.toString(16)
            result += if (h.length == 1) {
                "0" + h
            } else {
                h
            }
            i++
        }
    }
    return result
}
fun protectScreen(): Unit {
    val activity = UTSAndroid.getUniActivity()
    if (activity != null) {
        activity.runOnUiThread(fun(){
            activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        )
    }
}
fun randomHexByJs(length: Number): String {
    return randomHex(length)
}
fun protectScreenByJs(): Unit {
    return protectScreen()
}
