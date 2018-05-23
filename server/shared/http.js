module.exports = {
    sendRows: async function (req, res, responseData) {
        try {
            return res.send(responseData.rows);
        } catch (err) {
            return res.send(err);
        }
    }
}
