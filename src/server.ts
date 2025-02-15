import app from "./api/app";

const PORT=process.env.PORT || 6000
app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}`);
})