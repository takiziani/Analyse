const isalab = (req, res, next) => {
    if (req.role !== "lab") {
        return res.status(403).json({ error: 'Unauthorized user only lab' });
    }
    next();
};
export default isalab;