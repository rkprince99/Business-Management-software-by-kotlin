# Add project specific ProGuard rules here.

# Keep DTOs serialized by Moshi
-keepclassmembers class com.wiradata.erpapplication.data.remote.dto.** { *; }
-keep class com.wiradata.erpapplication.data.remote.dto.** { *; }

# Moshi
-keep class com.squareup.moshi.** { *; }
-keep interface com.squareup.moshi.** { *; }

# Retrofit + OkHttp
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
