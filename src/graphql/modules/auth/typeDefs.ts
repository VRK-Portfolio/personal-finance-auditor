export const authTypeDefs = `
    type Login {
        email: String!
        password: String!
    }

    type FieldError {
        field: String!
        message: String!
    }

    type AuthSuccess {
        errors: [FieldError!]
        success: Boolean!
        message: String!
        authToken: String
    }

    type SignUp {
        email: String!
        password: String!
        confirmPassword: String!
    }
    type Mutation {
        login(email: String!, password: String!): AuthSuccess
        signUp(email: String!, password: String!, confirmPassword: String!): AuthSuccess
    }
`;