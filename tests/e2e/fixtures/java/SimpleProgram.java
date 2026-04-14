/**
 * Simple Java program for E2E testing
 * Basic program with simple methods for debugging
 */
public class SimpleProgram {
    public static void main(String[] args) throws Exception {
        // Print immediately so we know the program started
        System.out.println("SimpleProgram started");
        System.out.flush();

        // Small delay to ensure debugger can connect
        Thread.sleep(100);

        int x = 10;
        int y = 20;
        int sum = add(x, y);
        System.out.println("Sum: " + sum);
        System.out.flush();

        // Add longer delay to keep program running
        Thread.sleep(60000);

        // Call another method
        int product = multiply(x, y);
        System.out.println("Product: " + product);
        System.out.flush();

        Thread.sleep(60000);

        System.out.println("SimpleProgram finished");
        System.out.flush();
    }

    public static int add(int a, int b) {
        return a + b;
    }

    public static int multiply(int a, int b) {
        return a * b;
    }
}
