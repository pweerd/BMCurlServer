/*
 * Copyright 2022, De Bitmanager
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package nl.bitmanager.webcurl;

import java.lang.reflect.Constructor;
import java.net.Proxy;
import java.security.cert.CertificateException;
import java.util.HashMap;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import okhttp3.OkHttpClient;

/**
 * Holds a set of http clients, keyed by the requested Timeout 
 * @author pweerd
 */
public class TimedHttpClients {
    public final Timeout defTimeout;
    private final OkHttpClient defClient;
    private final OkHttpClient.Builder defBuilder;
    private final HashMap<Timeout,OkHttpClient> clients;
    
    public TimedHttpClients(Proxy proxy, boolean ignoreCertErrors, Timeout timeout) {
        defTimeout = timeout;
        //defClient = createClient (proxy, ignoreCertErrors, timeout);
        defBuilder = createBuilder (proxy, ignoreCertErrors, timeout);
        defClient = defBuilder.build();
        clients = new HashMap<Timeout,OkHttpClient>();
    }
    
    public OkHttpClient getClient() {
        return createClient (defClient, defTimeout);
    }
    public OkHttpClient getClient(Timeout timeout) {
        if (timeout==null || defTimeout.equals(timeout)) return defClient;
        
        synchronized(clients) {
            OkHttpClient c = clients.get(timeout);
            if (c == null) {
                defBuilder.connectTimeout(timeout.connectTimeout, TimeUnit.MILLISECONDS);
                defBuilder.callTimeout(timeout.callTimeout, TimeUnit.MILLISECONDS);
                defBuilder.readTimeout(timeout.callTimeout, TimeUnit.MILLISECONDS);

                clients.put(timeout, c = defBuilder.build());
            }
            return c;
        }
    }
    
    
    
    
    private static OkHttpClient createClient(Proxy proxy, boolean ignoreCertErrors, Timeout timeout) {
        System.out.printf("ignoreCert=%s\n", ignoreCertErrors );
        try {
            OkHttpClient.Builder bldr = new OkHttpClient.Builder();
            bldr.connectTimeout(timeout.connectTimeout, TimeUnit.MILLISECONDS);
            bldr.callTimeout(timeout.callTimeout, TimeUnit.MILLISECONDS);
            bldr.readTimeout(timeout.callTimeout, TimeUnit.MILLISECONDS);
            if (proxy != null)
                bldr.proxy(proxy);
            
            if (ignoreCertErrors) {
                // Install the all-trusting trust manager
                final SSLContext sslContext = SSLContext.getInstance("SSL");
                sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
                // Create an ssl socket factory with our all-trusting manager
                final SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();
                
                bldr.sslSocketFactory(sslSocketFactory, (X509TrustManager)trustAllCerts[0]);
                bldr.hostnameVerifier(allowAllHosts);
                
            }
            return bldr.build();
        } catch (Exception err) {
            throw new RuntimeException (err.getMessage(), err);
        }
    }
    private static OkHttpClient.Builder createBuilder (Proxy proxy, boolean ignoreCertErrors, Timeout timeout) {
        try {
            OkHttpClient.Builder bldr = new OkHttpClient.Builder();
            bldr.connectTimeout(timeout.connectTimeout, TimeUnit.MILLISECONDS);
            bldr.callTimeout(timeout.callTimeout, TimeUnit.MILLISECONDS);
            bldr.readTimeout(timeout.callTimeout, TimeUnit.MILLISECONDS);
            if (proxy != null)
                bldr.proxy(proxy);
            
            if (ignoreCertErrors) {
                // Install the all-trusting trust manager
                final SSLContext sslContext = SSLContext.getInstance("SSL");
                sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
                // Create an ssl socket factory with our all-trusting manager
                final SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();
                
                bldr.sslSocketFactory(sslSocketFactory, (X509TrustManager)trustAllCerts[0]);
                bldr.hostnameVerifier(allowAllHosts);
                
            }
            return bldr;
        } catch (Exception err) {
            throw new RuntimeException (err.getMessage(), err);
        }
    }
    private static OkHttpClient createClient(OkHttpClient template, Timeout timeout) {
        try {
            Class<?>[] parmTypes = { OkHttpClient.class };
            Constructor<?> ctr = OkHttpClient.Builder.class.getDeclaredConstructor(parmTypes);
            ctr.setAccessible(true);
            
            // String arguments
            Object[] args = { template };
            OkHttpClient.Builder bldr = (OkHttpClient.Builder)ctr.newInstance(args);
            
            bldr.connectTimeout(timeout.connectTimeout, TimeUnit.MILLISECONDS);
            bldr.callTimeout(timeout.callTimeout, TimeUnit.MILLISECONDS);
            bldr.readTimeout(timeout.callTimeout, TimeUnit.MILLISECONDS);
            return bldr.build();
        } catch (Exception err) {
            throw new RuntimeException (err.getMessage(), err);
        }
    }
    
    // Create a trust manager that does not validate certificate chains
    private static final TrustManager[] trustAllCerts = new TrustManager[] { new X509TrustManager() {
        @Override
        public void checkClientTrusted(java.security.cert.X509Certificate[] chain, String authType) throws CertificateException {
            System.out.println ("TrustManager:checkClientTrusted");
        }

        @Override
        public void checkServerTrusted(java.security.cert.X509Certificate[] chain, String authType) throws CertificateException {
            System.out.println ("TrustManager:checkServerTrusted");
        }

        @Override
        public java.security.cert.X509Certificate[] getAcceptedIssuers() {
            System.out.println ("TrustManager.X509Certificate");
            return new java.security.cert.X509Certificate[] {};
        }
    } };

    private static final HostnameVerifier allowAllHosts = new HostnameVerifier() {
        @Override
        public boolean verify(String hostname, SSLSession session) {
            System.out.println ("HostnameVerifier.verify");
            return true;
        }
    };

    
}