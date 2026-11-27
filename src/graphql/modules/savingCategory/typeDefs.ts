export const savingCategoryTypeDefs = `
    type SavingCategory {
        _id: ID!
        userId: ID!
        name: String!
        createdAt: String!
        updatedAt: String!
    }

    type SavingCategoryResult {
        response: SavingCategory
        success: Boolean!
        message: String
        errors: [FieldError!]
    }

    type SavingCategoryListResult {
        response: [SavingCategory!]
        success: Boolean!
        message: String
        errors: [FieldError!]
    }

    type Query {
        savingCategories: SavingCategoryListResult!
    }

    type Mutation {
        addSavingCategory(name: String!): SavingCategoryResult!
        updateSavingCategory(_id: ID!, name: String!): SavingCategoryResult!
        deleteSavingCategory(_id: ID!): SavingCategoryResult!
    }
`;
