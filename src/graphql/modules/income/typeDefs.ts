export const incomeTypeDefs = `
    type Income {
        _id: ID!
        amount: Float!
        source: String!
        date: String!
    }

    type FieldError {
        field: String!
        message: String!
    }

    type IncomeResult {
        success: Boolean!
        message: String
        errors: [FieldError!]
    }

    type IncomeListResult {
        response: [Income!]
        success: Boolean!
        message: String
        errors: String
    }
    type Query {
        income(startDate: String, endDate: String): IncomeListResult!
    }

    type Mutation {
        addIncome(amount: Float!, source: String!, date: String): IncomeResult!
        deleteIncome(_id: ID!): IncomeResult!
        updateIncome(_id: ID!, amount: Float, source: String, date: String): IncomeResult!
    }
`