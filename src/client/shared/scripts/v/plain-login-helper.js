(function() {
    $(document).ready(function () {
        $('.ui.form.login').form({
            fields: {
                // TODO resource these strings
                email: {
                    identifier: 'email',
                    rules: [
                        {
                            // TODO - use same validation email in db
                            type: 'empty',
                            prompt: 'Please enter your e-mail'
                        },
                        {
                            type: 'email',
                            prompt: 'Please enter a valid e-mail'
                        }
                    ]
                },
                password: {
                    identifier: 'password',
                    rules: [
                        {
                            type: 'empty',
                            prompt: 'Please enter your password'
                        }
                    ]
                }
            },
            onSuccess: function (event, object) {
                //id_token
                if (!object.email || !object.password) {
                    return;
                }
                var payload = {
                    email: object.email,
                    password: object.password
                }
                if (window.inviteDetails) {
                    payload.inviteDetails = JSON.stringify(window.inviteDetails)
                }
                $.post('/auth/login', payload, function (data) {
                    localStorage.setItem('id_token', data.token);
                    window.location.replace('/p');
                }).fail(function (data) {
                    $('.post-error').text(data.responseJSON);
                    $('.post-error-wrapper').show();
                    //$('.provider-wrapper').transition('fade up show');
                });
            }
        });

        $('form').api({
            silent: true,
            beforeSend: function () {
                // Cancel default send
                return false;
            }
        });

    });
})();