(function() {
    $(document).ready(function () {
        $('.ui.form.register').form({
            fields: {
                // TODO resource these strings
                name: {
                    identifier: 'name',
                    rules: [
                        {
                            type: 'empty',
                            prompt: 'Please enter your name'
                        }
                    ]
                },
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
                // TODO - Should we impose a (massive) limit on anything that's gonna be in the db?
                // Just so we don't get spammed out the wazoo
                password: {
                    identifier: 'password',
                    rules: [
                        {
                            type: 'empty',
                            prompt: 'Please enter your password'
                        },
                        {
                            type: 'minLength[6]',
                            prompt: 'Your password must be at least {ruleValue} characters'
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
                    name: object.name,
                    email: object.email,
                    password: object.password
                }
                if (window.inviteDetails) {
                    payload.inviteDetails = JSON.stringify(window.inviteDetails)
                }
                $.post('/auth/register', payload, function (data) {
                    localStorage.setItem('id_token', data.token);
                    window.location.replace('/p');
                }).fail(function (data) {
                    $('.post-error').text(data.responseJSON.message);
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