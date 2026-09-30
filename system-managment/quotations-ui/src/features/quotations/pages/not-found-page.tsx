import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/button'
import { Card, CardContent } from '../../../components/ui/card'

export default function NotFoundPage() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-16 text-center">
        <p className="text-dashboard font-bold text-slate-200">404</p>
        <h2 className="mt-4 text-section text-slate-900">Page not found</h2>
        <p className="mt-2 max-w-md text-body text-slate-500">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/" className="mt-8">
          <Button>Back to Dashboard</Button>
        </Link>
      </CardContent>
    </Card>
  )
}
