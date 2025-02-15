import app from "./api/app";

const PORT=process.env.PORT || 6000
app.listen(PORT, () => {
    console.log(`Welcome to DevGPT! \n Server is running on port http://localhost:${PORT}`);
})