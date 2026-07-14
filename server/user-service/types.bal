type User record {
    string userId;
    string firstName;
    string? middleName;
    string lastName;
    string phoneNumber;
    string addressLine1;
    string? addressLine2;
    string? addressLine3;
    string? profilePicture;
    string createdAt;
    string updatedAt;
    Role role;
};

type Role record {
    string roleId;
    string roleName;
    string level;
};

type UserCreate record {
    string firstName;
    string? middleName;
    string lastName;
    string phoneNumber;
    string addressLine1;
    string? addressLine2;
    string? addressLine3;
    string? profilePicture;
};

type UserUpdate record {
    string? firstName;
    string? middleName;
    string? lastName;
    string? phoneNumber;
    string? addressLine1;
    string? addressLine2;
    string? addressLine3;
    string? profilePicture;
    Role? role;
};

type UserDelete record {
    string userId;
    string firstName;
};

type UserActivation record {
    string userId;
    string firstName;
};

type Response record {
    string? message;
    anydata? data;
};