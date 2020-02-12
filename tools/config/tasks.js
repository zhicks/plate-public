module.exports = {
    log: {
        compiled: function (file) {
            return 'Compiled: ' + file;
        },
        created: function (file) {
            return 'Created: ' + file;
        },
        modified: function (file) {
            return 'Modified: ' + file;
        }
    },
    clean: {
        keepSpecialComments: 0
    }
};
