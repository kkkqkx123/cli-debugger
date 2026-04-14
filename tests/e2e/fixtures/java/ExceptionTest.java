/**
 * Exception test program for E2E testing
 * Tests exception handling and debugging
 */
public class ExceptionTest {
    public static void main(String[] args) {
        System.out.println("Starting exception test");

        try {
            // This will throw an exception
            throwException();
        } catch (Exception e) {
            System.out.println("Caught exception: " + e.getMessage());
        }

        try {
            // This will throw a different exception
            throwNullPointerException();
        } catch (Exception e) {
            System.out.println("Caught NPE: " + e.getMessage());
        }

        System.out.println("Exception test completed");
    }

    private static void throwException() throws Exception {
        throw new Exception("Test exception");
    }

    private static void throwNullPointerException() {
        String str = null;
        // This will throw NPE
        System.out.println(str.length());
    }
}
