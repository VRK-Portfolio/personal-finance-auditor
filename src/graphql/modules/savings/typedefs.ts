export const savingsTypeDefs = `
    type Savings {
        _id: ID!
        userId: ID!
        amount: Float!
        savingCategoryId: ID!
        savingDate: String!
        createdAt: String!
        updatedAt: String!
    }

    type SavingsByIdResult {
        response: Savings
        success: Boolean!
        message: String
        errors: [FieldError!]
    }

    type SavingsListResult {
        response: [Savings!]
        success: Boolean!
        message: String
        errors: [FieldError!]
    }

    type Query {
        savings: SavingsListResult!
        savingsById(_id: ID!): SavingsByIdResult!
    }

    type Mutation {
        addSavings(amount: Float!, savingCategoryId: ID!, savingDate: String): SavingsByIdResult!
        updateSavings(_id: ID!, amount: Float, savingCategoryId: ID, savingDate: String): SavingsByIdResult!
        deleteSavings(_id: ID!): SavingsByIdResult!
    }
`;