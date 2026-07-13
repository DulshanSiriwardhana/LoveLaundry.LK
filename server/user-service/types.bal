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

type useCreate record {
    string firstName;
    string? middleName;
    string lastName;
    string phoneNumber;
    string addressLine1;
    string? addressLine2;
    string? addressLine3;
    string? profilePicture;
};

type userUpdate record {
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

type userDelete record {
    string userId;
    string firstName;
};

type userActivation record {
    string userId;
    string firstName;
};

type response record {
    string? message;
    anydata? data;
};