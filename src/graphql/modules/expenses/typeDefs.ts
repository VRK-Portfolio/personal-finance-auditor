export const expensesTypeDefs = `
    type Expense {
        _id: ID!
        userId: ID!
        amount: Float!
        category: ID!
        date: String
        merchant: String
        description: String
    }
    type ExpenseListResult {
        response: [Expense!]
        success: Boolean!
        message: String
        errors: [FieldError!]
    }
    type ExpenseByIdResult {
        response: Expense
        success: Boolean!
        message: String
        errors: [FieldError!]
    }
    type Query {
        expenses(startDate: String, endDate: String): ExpenseListResult!
        expenseById(_id: ID!): ExpenseByIdResult!
    }

    type ExpenseResult {
        response: Expense
        success: Boolean!
        message: String
        errors: [FieldError!]
    }

    input ExpenseInput {
        amount: Float!
        category: ID!
        date: String
        merchant: String
        description: String
    }
    input UpdateExpenseInput {
        amount: Float
        category: ID
        date: String
        merchant: String
        description: String
    }
    type Mutation {
        addExpense(input: ExpenseInput!): ExpenseResult!
        deleteExpense(_id: ID!): ExpenseResult!
        updateExpense(_id: ID!, input: UpdateExpenseInput!): ExpenseResult!
    }
`;