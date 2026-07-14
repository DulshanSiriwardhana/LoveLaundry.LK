import ballerina/http;
import ballerinax/postgresql;

configurable int db_port = ?;
configurable string db_host = ?;
configurable string db_password = ?;
configurable string db_user = ?;
configurable string db_name = ?;

postgresql:Options postgresqlOptions = {
    connectTimeout: 10
};

postgresql:Client dbClient = check new (
    username = db_user,
    password = db_password,
    database = db_name,
    host = db_host,
    port = db_port,
    options = postgresqlOptions
);

@http:ServiceConfig {
    cors: {
        allowOrigins: ["*"],
        allowMethods: ["POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "Access-Control-Allow-Origin", "X-Service-Name"]
    }
}

service /user\-service on new http:Listener(5000) {
    
}