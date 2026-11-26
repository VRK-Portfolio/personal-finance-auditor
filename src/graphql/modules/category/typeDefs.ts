export const categoryTypeDefs = `
    type Category {
        _id: ID!
        name: String!
        userId: ID!
    }

    type CategoryListResult {
        response: [Category!]
        success: Boolean!
        message: String
        errors: [FieldError!]
    }

    type CategoryByIdResult {
        response: Category
        success: Boolean!
        message: String
        errors: [FieldError!]
    }
    type Query {
        categories: CategoryListResult!
        categoryById(_id: ID!): CategoryByIdResult!
    }

    type CategoryResult {
        success: Boolean!
        message: String
        errors: [FieldError!]
    }
    type Mutation {
        addCategory(name: String!): CategoryResult!
        deleteCategory(_id: ID!): CategoryResult!
        updateCategory(_id: ID!, name: String!): CategoryResult!
    }

`;