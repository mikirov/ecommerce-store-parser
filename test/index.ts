import {createServer} from "../functions/src";
import request from 'supertest';
import * as http from "http";
import {Done} from "mocha";

describe('Our server', function() {
    let server: http.Server;

    // Called once before any of the tests in this block begin.
    before((done: Done) => {
        server = createServer(3000);
        done();
    });


    it('should send a PUT request with domain properly', function(done) {
        request(server)
            .put('/domain')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .send({domainUri: "https://drinkpurerose.com/"})
            .expect(200)
            .end((err, res) => {
                if(err) return done(err);
                done();
            })
    });

    after((done: Done) => {
        server.close()
        done();
    })

});
