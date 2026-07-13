type User record {
    string userId;
    string firstName;
    string? middleName;
    string lastName;
    string phoneNumber;
    string addressLine1;
    string addressLine2;
    string addressLine3;
    string? profilePicture;
    string createdAt;
    string updatedAt;
}

type Role record {
    string roleId;
    sring roleName;
    string level;
}