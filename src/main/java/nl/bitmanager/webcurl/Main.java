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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import nl.bitmanager.core.Invariant;
import nl.bitmanager.io.FileWatcher;
import nl.bitmanager.io.IOUtils;
import nl.bitmanager.webcurl.storage.Store;
import nl.bitmanager.webcurl.templates.StoredTemplateCollections;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Main {
    public static final Logger logger, dnsLogger, httpLogger, storeLogger, writerLogger, ajaxLogger, watcherLogger;
    public static final String logHeader = "----------------------------------------------------------------------";
    private static HttpServer server;
    
    static {
        logger = LoggerFactory.getLogger("main");
        dnsLogger = LoggerFactory.getLogger("Dns");
        httpLogger = LoggerFactory.getLogger("Http");
        storeLogger = LoggerFactory.getLogger("Store");
        writerLogger = LoggerFactory.getLogger("Store-wtr");
        ajaxLogger = LoggerFactory.getLogger("Ajax");
        watcherLogger = LoggerFactory.getLogger("Watcher");
    }

    static Store historyStore = null;
    static FileWatcher watcher;
    public static int getChangeId() {return watcher==null ? 0 : watcher.getChangeId();}

    public static void main(String[] args) {
        try {
            /*
             * Set system property to configure http server Should be done as a
             * first action, since those are read via static properties in
             * HttpServerConfig
             */
            System.setProperty("sun.net.httpserver.nodelay", "true");
            //System.setProperty("java.util.logging.manager", "org.apache.logging.log4j.jul.LogManager");
            
//            //Now prevent Log4J's shutdownhooks to run, otherwise we can't log in our shutdown hook
//            LoggerContextFactory factory = LogManager.getFactory();
//            if (factory instanceof Log4jContextFactory) {
//                System.out.println("register shutdown hook");
//                Log4jContextFactory contextFactory = (Log4jContextFactory) factory;
//                ((DefaultShutdownCallbackRegistry) contextFactory.getShutdownCallbackRegistry()).stop();
//            }

            logger.info("");
            logger.info(logHeader);
            logger.info("Starting WebCurl.");
            logger.info("Adding shutdown hook");
            watcher = new FileWatcher(logger);
            Runtime.getRuntime().addShutdownHook(new Thread() {

                @Override
                public void start() {
                    String trace = "tbd";// BrickUtil.getStackTrace(2, true);
                    logger.info("Shutdown was originated from:\n" + trace);
                    this.setDaemon(false);;
                    super.start();
                }

                @Override
                public void run() {
                    try {
                        logger.info("about to shutdown WebCurl...");
                        logger.info("stopping http server...");
                        if (server != null) server.stop();
                        logger.info("Trigger writing unsaved data.");
                        if (historyStore != null) historyStore.writeUnsaved();
                        logger.info("stopped server...");
                    } catch (Throwable e) {
                        e.printStackTrace();
                    }
                }
            });
            String settingsFile = locateSettings();
            logger.info(Invariant.format("Loading settings from  [%s].", settingsFile));
            Settings settings = Settings.get(settingsFile);

            watcher = new FileWatcher(watcherLogger);
            watcher.register(settings.settingsRoot(), p->"settings.xml".equals(p.getFileName().toString()));
            watcher.register(settings.templatePath, StoredTemplateCollections::fileFilter);
            watcher.start();
            
            historyStore = new Store (settings);
            
            String webRoot = IOUtils.locateFileToRoot("webroot");
            logger.info(Invariant.format("Starting http server at port [%d] from root [%s].", settings.serverPort, webRoot));
            server = new HttpServer(settings.serverPort, historyStore, webRoot);
        } catch (Exception e) {
            logger.error(e.getMessage(), e);
            System.exit(12);
        }
    }
    
    private static String locateSettings() {
        final String SETTINGS = "settings.xml";
        try {
            return IOUtils.locateFileToRoot(SETTINGS);
        } catch (Exception e) {
            try {
                Path p = Paths.get(IOUtils.locateFileToRoot("settings.example"));
                Files.copy(p, p.getParent().resolve(SETTINGS));
                return IOUtils.locateFileToRoot(SETTINGS);
            } catch (Exception e2) {
                logger.error("Cannot create settings.xml from settings.example", e2);
                throw new RuntimeException (e.getMessage(), e); //Show original exception
            }
        }
    }

}
