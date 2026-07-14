import ballerina/http;
import ballerina/log;
import ballerinax/postgresql;

configurable int db_port = ?;
configurable string db_host = ?;
configurable string db_password = ?;
configurable string db_user = ?;
configurable string db_name = ?;

int count = 0;

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
    resource function get health() returns Response {
        count = count+1;
        return {
            message: "Server is online.",
            data: [count]
        };
    }

    resource function get users() returns Response {
        log:printInfo("GET /users");

        return {
            message: "no",
            data: []
        };
    }
}