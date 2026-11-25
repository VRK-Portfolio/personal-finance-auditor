import bcrpt from 'bcrypt';

const SALT = 10;

export const hashPassword = async (password: string): Promise<string> => {
    return bcrpt.hash(password, SALT);
}

export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
    if(!hashedPassword) {
        return false;
    }
    return bcrpt.compare(password, hashedPassword);
}
