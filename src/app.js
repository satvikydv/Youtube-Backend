import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

//cors
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))


//middleware
app.use(express.json({limit: "16kb"}))          //to parse json data
app.use(express.urlencoded({extended: true}))   //to parse form data
app.use(express.static("public"))               //to serve static files
app.use(cookieParser())                         //to parse cookies

//router import
import userRouter from "./routes/user.routes.js"

//router use
app.use("/api/v1/users", userRouter)

export { app }