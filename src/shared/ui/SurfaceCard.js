import Card from './Card';

/**
 * @deprecated Usa <Card>. Se mantiene como alias sin padding para no romper
 * pantallas que todavía definen su propio padding en `style`.
 */
export default function SurfaceCard({ children, style, ...rest }) {
  return (
    <Card padding="none" style={style} {...rest}>
      {children}
    </Card>
  );
}
