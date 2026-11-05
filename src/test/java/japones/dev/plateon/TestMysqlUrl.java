package japones.dev.plateon;

final class TestMysqlUrl {
    private TestMysqlUrl() {}

    static String utc(String url) {
        if (url.contains("connectionTimeZone=")) return url;
        return url + (url.contains("?") ? "&" : "?") + "connectionTimeZone=UTC";
    }
}
