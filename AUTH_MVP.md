Create the following API routes in `apps/api/src/routes/auth.route.ts`

# POST    /api/auth/register
User should send `email`, `name` and `password` and the backend should validate input on request using zod. 
After zod validation you should check if the email is not already in use using drizzle's exported connection @apps/api/src/db/index.ts, if the email is not already in use hash the password using bcrypt with a salt from the env variable `BCRYPT_SALT` and save the data to the users table. Return a singned JWT token that has the user's ID and the user data sans the password 

# POST    /api/auth/login
User should send email and plaintext password and the backend should validate input on request using zod.
After zod validation search for the user using the provided email. If it exists check if plaintext password and hashed password match using bcrypt. 
Return a singned JWT token that has the user's ID and the user data sans the password 

# GET     /api/auth/me
Based on the ID inside the JWT sent with the request get the user's data and return it sans the password 